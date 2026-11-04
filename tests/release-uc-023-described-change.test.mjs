// Release tests of UC-023 Modify the architecture, on a change the author describes to a participant: what the deriving participant and the reviewing participant receive, what is checked
// before the author sees the draft, how a described change is classed, and the due diligence of a library it adopts. The job is MOD-job-runner's `change-architecture`, prepared and run over
// the product of tests/uc-023-harness.mjs with fixture participants as drivers; the chapters and the chapter 13 are the book's files on the disk.
// Run: node --test tests/release-uc-023-described-change.test.mjs
//
// Module: MOD-job-runner
// Module: MOD-approvals
// Module: MOD-trace-graph
// Guards: UC-023
// Level: release
//
// Written for the release testing of sprint 126 by developer-sonnet-l (ITM-739), who implemented none of ITM-724, ITM-728, ITM-729, ITM-730 or ITM-731 (RELEASE TESTS ARE NOT WRITTEN BY THE
// IMPLEMENTER). The participants are drivers that answer from a list, so that each case states what the participants are sent and what they answer; no request leaves the process.
// Where the pages and UC-023 disagree the case follows UC-023 and is marked { todo } with the finding; no case of this file is now. Readings the
// texts leave open, which the cases state:
//   - "the use cases the change concerns are accepted" (UC-023, Precondition) is read as the use cases the job's parameter `useCases` names; the dashboard's prompt bar names none, so a change
//     it starts is not held back by an open use case (the pull request names this).
//   - "the whole architecture" is every decision and module file of the default branch, each given with its whole text.
//   - A draft is "checked before a person sees it" when the job's result holds the corrected draft and the rounds, and the findings of a round reached the drafter before the draft was returned.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runJob, writeResult } from "../src/job-runner/index.mjs";
import { formatFinding } from "../src/text-tools/index.mjs";
import { ARC1, ARC1_PATH, ARC2, DESK, DESK_PATH, LOAN, REPORT, SHELF_MOD, SPEC, SYNC, SYNC_PATH, UC1, UC2, answer, driver, jobOf, scenario, DRAFTER, REVIEWER, SMALL, TWIN } from "./uc-023-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BOOK = "docs/sources/SRC-vibe-coding/2026-10-05/";
const CHAPTERS = { 9: "09_system-modeling.md", 10: "10_architectural-design.md", 11: "11_agentic-design-and-control-patterns.md", 12: "12_implementation-and-version-control.md" };
const ARC1_RETITLED = ARC1.replace("one synchronisation module.", "one synchronisation module, which retries.").replace("title: Lending is synchronised", "title: Lending is synchronised with a retry")
  .replace("# ARC-001 Lending is synchronised", "# ARC-001 Lending is synchronised with a retry");
const change = (text, path = ARC1_PATH, of = "ARC-001") => ({ files: [{ path, text, class: "change", of }] });
const PARAMS = { target: "ARC-001", instruction: "Let the sync retry" };
const run = (job, drivers) => runJob(job.prepared, drivers, { attended: true, context: job.context });
const WARNING = { artifact: ARC1_PATH, line: 9, rule: "A MODULE IS CHECKED AGAINST ITS SUBSYSTEM", what: "MOD-desk and MOD-report have no named owner", fix: "name who owns each module" };
const warningLine = formatFinding({ ...WARNING, kind: "warning" });

// TST-739201 · level: release · module: MOD-job-runner
// guards: AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; UC-023
// given: a described change of ARC-001 prepared with a deriving participant and a reviewing participant with another model; the drafter first returns the decision without its section Alternatives, the reviewer finds a warning, the drafter then returns the section back and answers the warning
// input: the job is run attended
// expect: the reviewer received the draft before the result was returned; the drafter's second input holds the error of the missing section and the reviewer's warning, each in the compiler's form; the result holds the corrected draft, with its section Alternatives, two rounds, no finding left, stopped because it passed
test("TST-739201: UC-023 2 a drafted change is checked, and sent back with its findings, before the person sees it", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  assert.deepEqual(job.prepared.blocking, []);
  const broken = ARC1_RETITLED.replace(/## Alternatives\n\nOne module\.\n\n/, "");
  const drafter = driver(DRAFTER, [answer(change(broken)), answer(change(ARC1_RETITLED), [{ finding: warningLine, how: "answered", text: "the owners are named in the module files" }])]);
  const reviewer = driver(REVIEWER, [answer({ findings: [WARNING] })]);
  const result = await run(job, { drafter, reviewers: [reviewer] });
  assert.ok(reviewer.inputs.length >= 1, "the reviewer is asked");
  assert.ok(reviewer.inputs[0].prompt.includes("one synchronisation module, which retries."), "with the draft");
  const again = drafter.inputs[1].findings.map(formatFinding);
  assert.ok(again.some((line) => /error: .*Alternatives.*\[/.test(line)), `the error of the missing section is sent back: ${again.join("\n")}`);
  assert.ok(again.includes(warningLine), "and the reviewer's warning");
  assert.equal(result.stoppedBecause, "passed");
  assert.equal(result.rounds.length, 2);
  assert.deepEqual(result.remaining, []);
  assert.match(result.draft.files[0].text, /## Alternatives/);
});

// TST-739202 · level: release · module: MOD-job-runner
// guards: A REVIEWER'S FINDING IS A WARNING; UC-023
// given: the job of TST-739201 whose reviewer finds one thing, in every round
// input: the job is run once with a drafter that answers the finding with a reason, and once with a drafter that does not
// expect: the finding is a warning in both runs; answered with a reason it ends the loop (stopped because it passed, nothing left); unanswered (counter-proof) it does not: the loop stops at the second round because nothing changed, and the warning is left
test("TST-739202: UC-023 2 a reviewing participant's finding is a warning that an answer settles", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const answered = await run(job, { drafter: driver(DRAFTER, [answer(change(ARC1_RETITLED)), answer(change(ARC1_RETITLED), [{ finding: warningLine, how: "answered", text: "the owners are named in the module files" }])]),
    reviewers: [driver(REVIEWER, [answer({ findings: [WARNING] })])] });
  assert.deepEqual(answered.rounds[0].findings.map((found) => found.kind), ["warning"]);
  assert.equal(answered.stoppedBecause, "passed");
  assert.deepEqual(answered.remaining, []);

  const ignored = await run(job, { drafter: driver(DRAFTER, [answer(change(ARC1_RETITLED))]), reviewers: [driver(REVIEWER, [answer({ findings: [WARNING] })])] });
  assert.equal(ignored.stoppedBecause, "unchanged", "counter-proof: unanswered, the loop does not end as passed");
  assert.deepEqual(ignored.remaining.map(formatFinding), [warningLine]);
});

// TST-739203 · level: release · module: MOD-approvals
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; UC-023
// given: a product with a SPEC of three requirements, three use cases of which UC-001 and UC-002 are accepted, two decisions and four module files; a described change of ARC-001
// input: the job is prepared and run with a deriving participant
// expect: the input the drafter is sent holds the whole SPEC, UC-001 and UC-002, and the whole text of every decision and every module file, none left out; the parts of the architecture are six, one for each file
test("TST-739203: UC-023 2 the deriving participant is sent the whole SPEC, the accepted use cases and the whole architecture", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [] });
  assert.equal(job.prepared.parts.filter((part) => part.recipe === "whole-architecture").length, 6);
  const drafter = driver(DRAFTER, [answer(change(ARC1_RETITLED))]);
  await run(job, { drafter, reviewers: [] });
  const sent = drafter.inputs[0].prompt;
  for (const [what, held] of [["the SPEC", SPEC], ["UC-001", UC1], ["UC-002", UC2], ["ARC-001", ARC1], ["ARC-002", ARC2], ["MOD-sync", SYNC], ["MOD-desk", DESK], ["MOD-report", REPORT], ["MOD-shelf", SHELF_MOD]]) {
    assert.ok(sent.includes(held), `${what} is in what the drafter is sent`);
  }
});

// TST-739204 · level: release · module: MOD-job-runner
// guards: AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; UC-023
// given: the book's chapters 9, 10, 11, 12 and 13 as files on the disk; a described change of ARC-001
// input: the job is prepared and run with a deriving participant and a reviewing participant
// expect: the drafter's input and the reviewer's input each hold the whole text of chapters 9, 10, 11 and 12 and nothing of chapter 13
test("TST-739204: UC-023 2 an architecture job is sent chapters 9 to 12 of the book in full", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const drafter = driver(DRAFTER, [answer(change(ARC1_RETITLED))]), reviewer = driver(REVIEWER, [answer({ findings: [] })]);
  await run(job, { drafter, reviewers: [reviewer] });
  for (const [who, sent] of [["drafter", drafter.inputs[0].prompt], ["reviewer", reviewer.inputs[0].prompt]]) {
    for (const [number, file] of Object.entries(CHAPTERS)) assert.ok(sent.includes(read(`${BOOK}${file}`).trim()), `${who}: chapter ${number} in full`);
    assert.ok(!sent.includes(read(`${BOOK}13_software-testing.md`).slice(0, 2000)), `${who}: no chapter 13`);
  }
});

// TST-739205 · level: release · module: MOD-job-runner
// guards: NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; UC-023
// given: a participant whose context holds 100 tokens, which cannot hold the SPEC, the use cases and the architecture; counter-proof — a participant whose context holds 300000
// input: a described change is prepared with each, and the one that does not hold it is run
// expect: the small participant is named as not fitting, with the size the job needs and its own context; the job refuses to start, and nothing is sent to the participant; the large participant is not named, and the job has nothing that blocks it
test("TST-739205: UC-023 2 a prompt that does not fit is named, and nothing is sent", async () => {
  const s = await scenario({});
  const small = await jobOf(s, "change-architecture", PARAMS, { drafter: SMALL, reviewers: [] });
  assert.deepEqual(small.prepared.notFitting.map((each) => each.participant.name), ["small"]);
  assert.equal(small.prepared.notFitting[0].context, 100);
  assert.ok(small.prepared.notFitting[0].size > 100);
  const sentTo = driver(SMALL, [answer(change(ARC1_RETITLED))]);
  await assert.rejects(run(small, { drafter: sentTo, reviewers: [] }), { name: "NotStartable" });
  assert.equal(sentTo.inputs.length, 0, "nothing is sent");

  const large = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [] });
  assert.deepEqual(large.prepared.notFitting, [], "counter-proof");
  assert.deepEqual(large.prepared.blocking, []);
});

// TST-739206 · level: release · module: MOD-approvals
// guards: ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES; UC-023
// given: UC-003, whose text no approval record names, and UC-001, which is accepted; a described change of the architecture that concerns the use case
// input: the job is prepared with the parameter useCases naming UC-003, and then naming UC-001
// expect: with UC-003 the job does not start and an error names UC-003; counter-proof — with UC-001 nothing blocks it
test("TST-739206: UC-023 a change is drafted only against use cases whose text a record names", async () => {
  const s = await scenario({});
  const open = await jobOf(s, "change-architecture", { ...PARAMS, useCases: ["UC-003"] }, { drafter: DRAFTER, reviewers: [] });
  assert.deepEqual(open.prepared.blocking.map((found) => [found.kind, /UC-003/.test(found.what)]), [["error", true]]);
  await assert.rejects(run(open, { drafter: driver(DRAFTER, [answer(change(ARC1_RETITLED))]), reviewers: [] }), { name: "NotStartable" });
  const accepted = await jobOf(s, "change-architecture", { ...PARAMS, useCases: ["UC-001"] }, { drafter: DRAFTER, reviewers: [] });
  assert.deepEqual(accepted.prepared.blocking, [], "counter-proof");
});

// TST-739207 · level: release · module: MOD-job-runner
// guards: NO REVIEWER IS THE DRAFTER; UC-023
// given: a deriving participant drafter (model-a); candidates for the reviewing participant: drafter itself, twin with the same model, reviewer with model-b
// input: the described change is prepared with each of the three as its reviewer
// expect: with drafter itself and with twin the job does not start and an error under NO REVIEWER IS THE DRAFTER names the reviewer; counter-proof — with reviewer nothing blocks it
test("TST-739207: UC-023 the reviewing participant is neither the drafter nor uses its model", async () => {
  const s = await scenario({});
  const blocking = async (reviewer) => (await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [reviewer] })).prepared.blocking.map((found) => [found.kind, found.rule, found.what.includes(reviewer.name)]);
  const refused = ["error", "NO REVIEWER IS THE DRAFTER", true];
  assert.deepEqual(await blocking(DRAFTER), [refused]);
  assert.deepEqual(await blocking(TWIN), [refused]);
  assert.deepEqual(await blocking(REVIEWER), [], "counter-proof: another participant with another model");
});

const asDecision = (id, title) => ARC1.replace("id: ARC-001", `id: ${id}`).replace("title: Lending is synchronised", `title: ${title}`).replace("# ARC-001 Lending is synchronised", `# ${id} ${title}`);

// TST-739208 · level: release · module: MOD-job-runner
// guards: THE DERIVATION RULES HOLD FOR ARCHITECTURE; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; UC-023
// given: the architecture of the product; drafts of a described change in which a decision states the title of ARC-001 as a new decision, states it as a duplicate of ARC-001, two new decisions state one title, and a decision has a title of its own
// input: each draft is run once with a drafter that does not correct it
// expect: the decision with ARC-001's title classed new is an error that names ARC-001 and asks to class it as a duplicate of ARC-001; classed a duplicate of ARC-001 it gives no finding and its class in the result is duplicate of ARC-001; two new decisions of one title are one candidate in the result, naming both files; a decision with a title of its own classed new (counter-proof) gives no finding
test("TST-739208: UC-023 the derivation rules hold: a decision that restates an existing one is found without a model, and equal candidates are merged", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [] });
  // The findings of the rules of the derivation; the checks across artifacts (a decision that designs the modules another designs) are other requirements'.
  const once = async (files) => {
    const result = await run(job, { drafter: driver(DRAFTER, [answer({ files })]), reviewers: [] });
    return { ...result, remaining: result.remaining.filter((found) => ["EXACT DUPLICATES ARE FOUND WITHOUT A MODEL", "A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT"].includes(found.rule)) };
  };
  const A = "docs/architecture/ARC-009-lending-sync.md", B = "docs/architecture/ARC-010-lending-sync.md", C = "docs/architecture/ARC-011-notifications.md";

  const asNew = await once([{ path: A, text: asDecision("ARC-009", "Lending is synchronised"), class: "new" }]);
  assert.deepEqual(asNew.remaining.map((found) => [found.kind, found.rule, found.fix]), [["error", "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL", "class it as duplicate of ARC-001"]]);
  assert.match(asNew.remaining[0].what, /"ARC-001"/);

  const asDuplicate = await once([{ path: A, text: asDecision("ARC-009", "Lending is synchronised"), class: "duplicate", of: "ARC-001" }]);
  assert.deepEqual(asDuplicate.remaining, []);
  assert.deepEqual(asDuplicate.classes.map((each) => [each.class, each.of]), [["duplicate", "ARC-001"]]);

  const twice = await once([{ path: B, text: asDecision("ARC-010", "Notifications are sent"), class: "new" }, { path: C, text: asDecision("ARC-011", "Notifications are sent"), class: "new" }]);
  assert.equal(twice.classes.length, 1, "one candidate");
  assert.deepEqual([...twice.classes[0].refs].sort(), [B, C], "naming both files");

  const own = await once([{ path: C, text: asDecision("ARC-011", "Notifications are sent"), class: "new" }]);
  assert.deepEqual(own.remaining, [], "counter-proof: a title of its own is new");
});

// TST-739209 · level: release · module: MOD-job-runner
// guards: A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE; UC-023
// given: a described change of two module files, MOD-sync and MOD-desk, with a reviewing participant; the architecture holds six files
// input: the job is run; the reviewer's input is read
// expect: the reviewer's input holds the whole text of every one of the six files of the architecture, the two changed ones and the four that the change leaves as they are.
test("TST-739209: UC-023 a change that concerns two modules is checked by the reviewer together with the whole architecture", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", { target: "MOD-sync", instruction: "Remove pull" }, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const files = { files: [{ path: SYNC_PATH, text: SYNC.replace("It synchronises the loans.", "It synchronises the loans well."), class: "change", of: "MOD-sync" },
    { path: DESK_PATH, text: DESK.replace("It does one thing.", "It lends."), class: "change", of: "MOD-desk" }] };
  const reviewer = driver(REVIEWER, [answer({ findings: [] })]);
  await run(job, { drafter: driver(DRAFTER, [answer(files)]), reviewers: [reviewer] });
  const sent = reviewer.inputs[0].prompt;
  assert.ok(sent.includes("It synchronises the loans well.") && sent.includes("It lends."), "known positive: the two changed files are in what the reviewer is sent");
  assert.ok(sent.includes(SPEC), "known positive: and the SPEC");
  for (const [what, held] of [["ARC-001", ARC1], ["ARC-002", ARC2], ["MOD-report", REPORT], ["MOD-shelf", SHELF_MOD]]) assert.ok(sent.includes(held), `${what} is in what the reviewer is sent`);
});

// TST-739210 · level: release · module: MOD-job-runner
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; UC-023
// given: a described change of ARC-001 with a reviewing participant; the architecture holds six files
// input: the job is run; the reviewer's input is read
// expect: the reviewer's input holds the whole SPEC, every accepted use case and every file of the architecture.
test("TST-739210: UC-023 the reviewing participant is sent the whole SPEC, the accepted use cases and the whole architecture", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const reviewer = driver(REVIEWER, [answer({ findings: [] })]);
  await run(job, { drafter: driver(DRAFTER, [answer(change(ARC1_RETITLED))]), reviewers: [reviewer] });
  const sent = reviewer.inputs[0].prompt;
  for (const [what, held] of [["the SPEC", SPEC], ["UC-001", UC1], ["UC-002", UC2]]) assert.ok(sent.includes(held), `known positive: ${what}`);
  for (const [what, held] of [["ARC-002", ARC2], ["MOD-sync", SYNC], ["MOD-desk", DESK], ["MOD-report", REPORT], ["MOD-shelf", SHELF_MOD]]) assert.ok(sent.includes(held), `${what} is in what the reviewer is sent`);
});

// ---------------------------------------------------------------- a library adopted by a change

const PACKAGE = (license, repository) => ({ license, repository: { url: repository }, "dist-tags": { latest: "1.1.0" }, versions: { "1.0.0": {}, "1.1.0": {} },
  time: { "1.0.0": "2024-01-01T00:00:00.000Z", "1.1.0": "2025-01-01T00:00:00.000Z" } });
const registry = async (input) => {
  const url = String(input);
  if (url === "https://registry.npmjs.org/loan-lib") return new Response(JSON.stringify(PACKAGE("MIT", "https://github.com/alice/loan-lib")), { status: 200 });
  if (url === "https://registry.npmjs.org/shelf-lib") return new Response(JSON.stringify(PACKAGE("Apache-2.0", "https://github.com/alice/shelf-lib")), { status: 200 });
  if (url.includes("downloads/point/last-month/loan-lib")) return new Response(JSON.stringify({ downloads: 1234 }), { status: 200 });
  if (url.includes("downloads/point/last-month/shelf-lib")) return new Response(JSON.stringify({ downloads: 4321 }), { status: 200 });
  if (url === "https://registry.npmjs.org/blocked-lib") throw new TypeError("Failed to fetch");
  return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
};
// ARC-001 replacing its synchronisation by a library: the chosen candidate and the alternative, as the decision's tables state them.
const adopting = (chosen, alternative) => ARC1_RETITLED.replace(/## Decision\n\n[^]*?\n\n```mermaid[^]*?```\n/, `## Decision\n\n| Candidate | Ecosystem | Repository | Role |\n|---|---|---|---|\n| ${chosen} | npm | https://github.com/alice/${chosen} | chosen |\n`)
  .replace(/## Alternatives\n\n[^]*?\n\n## Consequences/, `## Alternatives\n\n| Candidate | Ecosystem | Repository |\n|---|---|---|\n| ${alternative} | npm | https://github.com/alice/${alternative} |\n\n## Consequences`);

// TST-739211 · level: release · module: MOD-job-runner
// guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; DUE DILIGENCE IS FETCHED, NOT RECALLED; UC-023
// given: a described change that replaces the synchronisation by the library loan-lib, with shelf-lib as the alternative, and a package registry that serves both; then a registry that cannot be reached for the chosen library
// input: the job is run attended, and the result is written on the person's click
// expect: the draft the person sees holds a section Due diligence that names loan-lib as chosen and shelf-lib, each with the licence the registry gave (MIT, Apache-2.0), the address it was read from and the date it was read, and no step finding; with the registry unreachable the result carries an error step finding under A REUSE DECISION RECORDS ITS DUE DILIGENCE, and writing it throws DueDiligenceMissing and writes no commit
test("TST-739211: UC-023 a library the change adopts goes through the due diligence, fetched from its registry", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [], fetch: registry });
  const result = await run(job, { drafter: driver(DRAFTER, [answer(change(adopting("loan-lib", "shelf-lib")))]), reviewers: [] });
  assert.deepEqual(result.stepFindings, []);
  const section = result.draft.files[0].text.split("## Due diligence")[1];
  assert.ok(section, "a section Due diligence");
  assert.ok(section.includes("loan-lib (npm) - chosen") && section.includes("shelf-lib (npm)"), section);
  assert.ok(section.includes("MIT") && section.includes("Apache-2.0"), "the licences the registry gave");
  assert.ok(section.includes("https://registry.npmjs.org/loan-lib") && section.includes("https://registry.npmjs.org/shelf-lib"), "the addresses it was read from");
  assert.ok(section.includes("2026-10-30"), "and the date it was read");

  const blocked = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [], fetch: registry });
  const unread = await run(blocked, { drafter: driver(DRAFTER, [answer(change(adopting("blocked-lib", "shelf-lib")))]), reviewers: [] });
  assert.ok(unread.stepFindings.some((found) => found.kind === "error" && found.rule === "A REUSE DECISION RECORDS ITS DUE DILIGENCE"), JSON.stringify(unread.stepFindings));
  const before = s.product.writes.length;
  await assert.rejects(writeResult(blocked.prepared, unread.draft, { result: unread, context: blocked.context }), { name: "DueDiligenceMissing" });
  assert.equal(s.product.writes.length, before, "no commit");
});
