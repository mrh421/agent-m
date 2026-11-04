// System coverage for UC-041 Close a sprint with review and retrospective, walked as the dashboard and an agent's close reach it: the flow map (TST-991201) names, for every step of the main flow and every
// alternative flow, the executable tests that walk it, and the cases walk what no test walked as a whole — a sprint the Product Owner ended, shown on Progress as waiting for its review (1); the close by its
// agent, a job of the kind close-sprint run unattended as CI and a Bridge run it, from the facts the recipe derives to the one commit of the review, the unfinished items and the retrospective (2 to 6); the
// sources of its feedback (3); the numbers of the retrospective (5); Progress and Backlog after the close (6); an empty increment (2a); changes to the model and to a participant's instructions (5a, 5b); a draft
// without a retrospective returned as a correction round (6a); and an increment given up (7b). The job is the real MOD-job-runner with MOD-job-catalogue's close-sprint and MOD-work-plans' strategies behind
// tests/uc-041-harness.mjs' host in memory; the pages are the real routes of MOD-implementation-pages behind tests/uc-032-harness.mjs' fake of GitHub. No request leaves the process.
// Run: node --test tests/system-uc-041-close-a-sprint.test.mjs
//
// Module: MOD-work-plans
// Module: MOD-workflow-entries
// Module: MOD-implementation-pages
// Guards: UC-041
// Level: system
//
// Authored by developer-opus-e (ITM-991), who built, among the code UC-041's flow runs, ITM-987 (closeSprint writes the feedback's new items in its one commit), ITM-1171 (targetBranch, the branch an item's
// work is merged into) and ITM-1260 and ITM-1264 (Progress and Backlog draw the view stored for their commit); RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER binds level release, so these system cases may
// walk that behaviour, and the release file leaves it to the release tests other writers wrote. Where the code and UC-041 disagree the case follows UC-041 and is marked `todo` with the word FINDING (named in
// FLOW_FINDINGS). Each case states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the
// expected passages itself and checks that UC-041 still says them.
// Readings the texts leave open, which the cases state:
//   - "The closer derives from the repository" (2) is read, for an agent, as the recipe sprint-facts the kind close-sprint names: the closer receives the derived facts and writes from them.
//   - "the dashboard shows the failing tests (UC-028)" (7a) and "the pull request of this sprint's branch is brought up to date" (7c) are the repository server's work on that pull request; Agent M's part is
//     that the increment's items stay held while it is not merged, which TST-991303 walks.
//   - "Agent M returns the draft to the closer with the finding, as a correction round" (6a) is read as the job runner's next request to the closer carrying the finding, before anything is committed.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { giveUpIncrement, heldItems } from "../src/work-plans/index.mjs";
import { CLOSE, PULLS, RECORD, SPRINT, closeWorld, documentsOf, open, part, plain, pr, shop } from "./uc-041-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-041-close-a-sprint.md";
const SELF = "tests/system-uc-041-close-a-sprint.test.mjs";
const RELEASE = "tests/release-uc-041-close-a-sprint.test.mjs";
const PY = "tests/test_time_box_close.py";
const SCHEDULE = "tests/workflow-entries-schedule.test.mjs";
const BRIDGE = "tests/bridge-jobs-sprint-close.test.mjs";
const WRITER = "tests/work-plans-sprint-record-writer.test.mjs";
const CHECKS = "tests/work-plans-sprint-record-checks.test.mjs";
const FACTS = "tests/work-plans-sprint-facts.test.mjs";
const GIVE_UP = "tests/work-plans-give-up-increment.test.mjs";
const ENDED_PAGES = "tests/release-itm-1330-sprint-ended-is-drawn-as-ended.test.mjs";
const NEW_ITEMS = "tests/release-itm-987-close-new-items.test.mjs";
const LINK = "https://github.com/akmaier/agent-m/blob/main/docs/backlog/sprints/team1/02.md";

/** What Progress and Backlog say of `team` over `files`, as a person reads them. */
async function pagesOf(files, team = "team1", pullRequests = PULLS) {
  const progress = await open("progress", {}, { files, pullRequests });
  const backlog = await open("backlog", {}, { files, pullRequests });
  try {
    return { progress: plain(part(progress.html(), `data-team="${team}"`)), backlog: plain(part(backlog.html(), `data-team="${team}"`)), backlogHtml: part(backlog.html(), `data-team="${team}"`) };
  } finally { progress.done(); backlog.done(); }
}
const factsOf = async (w) => JSON.parse((await w.recipe()).find((each) => each.name === `facts of sprint ${SPRINT}`).text);

// ---------------------------------------------------------------- the flow map

// The passages of UC-041 the system tests walk, each with the executable tests that walk it; a passage the code does otherwise is a finding, a `todo` case that fails now and names what it does instead.
const FLOW_EVIDENCE = {
  "main-1-ends": { uc: "The sprint ends — its end date is reached or, in a sprint without a time box, every selected item is done or the Product Owner has ended it", evidence: [[SELF, "TST-991202"], [PY, "TST-991403"], [ENDED_PAGES, "TST-1330101"]] },
  "main-1-close-job": { uc: "An agent's close job starts by itself", evidence: [[SELF, "TST-991207"]] },
  "main-1-by-itself": { uc: "An agent's close job starts by itself — no click.", evidence: [[PY, "TST-991403"], [SCHEDULE, "TST-1032101"], [BRIDGE, "TST-1033001"]] },
  "main-2-done": { uc: "the items that are done — merged, with their Definition of Done met — each with its pull request, the requirements it realises and the tests that guard them", evidence: [[SELF, "TST-991202"], [WRITER, "TST-620001"], [FACTS, "TST-986001"]] },
  "main-2-not-done": { uc: "the items not done, each with its state and reason (UC-034)", evidence: [[SELF, "TST-991203"]] },
  "main-2-increment": { uc: "The increment is the set of done items", evidence: [[SELF, "TST-991202"], [FACTS, "TST-986006"]] },
  "main-3-sources": { uc: "the issues and mails that arrived during the sprint, the job records, the test results —, naming each source", evidence: [[SELF, "TST-991204"], [PY, "TST-991404"]] },
  "main-3-lines": { uc: "one line per point, each either *new backlog item*, *change to an existing item*, or *noted*", evidence: [[SELF, "TST-991204"]] },
  "main-3-stakeholder": { uc: "The review states that no stakeholder took part unless their feedback is recorded somewhere it read.", evidence: [[PY, "TST-991404"], [CHECKS, "TST-619004"]] },
  "main-4-unfinished": { uc: "the closer chooses **into the next sprint** if it is still ready and fits the next sprint's selection, otherwise **back to the backlog**, with the reason recorded", evidence: [[SELF, "TST-991202"]] },
  "main-5-numbers": { uc: "jobs failed or retried, correction rounds, time items waited at gates, flaky tests, cost where known —, derived and not typed", evidence: [[SELF, "TST-991205"], [FACTS, "TST-986003"], [FACTS, "TST-986004"]] },
  "main-5-goes": { uc: "For each change, the entry names where it goes", evidence: [[SELF, "TST-991209"], [CHECKS, "TST-619006"]] },
  "main-5-as-proposal": { uc: "is written as a proposal that a person accepts", evidence: [[RELEASE, "TST-991306"]] },
  "main-5-proposal": { uc: "nothing of the process changes by itself", evidence: [[PY, "TST-991406"], [SELF, "TST-991209"]] },
  "main-6-commit": { uc: "The closer commits the review and the retrospective as one Markdown file with the sprint", evidence: [[SELF, "TST-991202"], [WRITER, "TST-620001"]] },
  "main-6-new-items": { uc: "the new backlog items from the feedback", evidence: [[NEW_ITEMS, "TST-987301"]] },
  "main-6-new-items-asked": { uc: "the new backlog items from the feedback", evidence: [[SELF, "TST-991206"]] },
  "main-6-name": { uc: "under the closer's name — an agent's like any job (UC-036)", evidence: [[SELF, "TST-991202"], [PY, "TST-991402"]] },
  "main-6-holds": { uc: "Items that go back to the backlog are no longer held by the sprint; its done items stay held until its increment is merged into the default branch.", evidence: [[RELEASE, "TST-991303"]] },
  "main-6-pages": { uc: "The closer commits the review and the retrospective", evidence: [[SELF, "TST-991202"]] },
  "main-7-gate": { uc: "once the role the model names for that gate has decided it", evidence: [[RELEASE, "TST-991304"]] },
  "main-7-closer": { uc: "If the closer also holds that role, its own decision does not pass the gate", evidence: [[RELEASE, "TST-991304"]] },
  "2a-empty": { uc: "**2a. No item is done.** The review still happens and is recorded; the increment is empty, and the review says so.", evidence: [[SELF, "TST-991208"], [FACTS, "TST-986005"]] },
  "5a-model": { uc: "**5a. A retrospective change concerns the process model.**", evidence: [[SELF, "TST-991209"]] },
  "5b-instructions": { uc: "**5b. A retrospective change concerns an agent's instructions.**", evidence: [[SELF, "TST-991209"]] },
  "6a-no-retrospective": { uc: "**6a. The closer's draft holds no retrospective.** Agent M returns the draft to the closer with the finding, as a correction round", evidence: [[SELF, "TST-991210"], [PY, "TST-991401"]] },
  "7a-red": { uc: "**7a. CI on the merge of the sprint branch is red.** The increment is not merged", evidence: [[RELEASE, "TST-991303"]] },
  "7b-given-up": { uc: "If the Product Owner gives the increment up, its done items stay done and are no longer held", evidence: [[SELF, "TST-991211"], [GIVE_UP, "TST-1232003"]] },
  "main-3-sources-kept": { uc: "naming each source", evidence: [[RELEASE, "TST-991305"]] },
  "7c-other-team": { uc: "**7c. Another team's increment was merged into the default branch first.**", evidence: [[RELEASE, "TST-991302"]] },
};
// The passages the code does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {};

// TST-991201 · level: system · module: system
// guards: UC-041
// given: UC-041 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow, steps 1 to 7, and of the alternative flows with its executable evidence or its finding
// expect: every named passage stands in UC-041; every evidence file exists and declares its TST id; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-041 names is among the passages; known positive: UC-041 names exactly the seven alternative flows 2a, 5a, 5b, 6a, 7a, 7b and 7c, and each of the seven main steps has a passage
test("TST-991201: UC-041 every passage of the main flow and of each alternative flow has an executable test or a finding", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-041 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id), `${name}: ${id} is declared in ${file}`);
    }
  }
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle), `${name}: UC-041 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["2a", "5a", "5b", "6a", "7a", "7b", "7c"], "known positive: UC-041 names these alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- the main flow

// TST-991202 · level: system · module: system
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; A SPRINT ENDS WITH A RETROSPECTIVE; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
// given: the product of tests/uc-041-harness.mjs: team1's sprint team1/02, without a time box, selects ITM-001 (pull request 1 merged into sprint/team1/02) and ITM-002 (pull request 2 open, its job failed), its closer the agent closer-bot, ended by the Product Owner on 2026-10-30
// input: the Product Owner opens Progress and Backlog; the close job of team1/02 runs unattended with closer-bot, who answers once with a clean close (ITM-002 into the next sprint, a retrospective of two entries); Progress and Backlog are opened again
// expect: before, Progress shows team1/02 closed by closer-bot and says "It ended on 2026-10-30; its review and retrospective are not recorded yet"; the closer is sent the facts of team1/02 with the increment ITM-001, pull request 1, realising RULE ONE, guarded by TST-001; the job passes in one round and makes one commit of the record alone, whose message names Agent-M-Participant: closer-bot; the record keeps its text and gains ## Review (the increment, ITM-002 not done, the feedback, its sources), ## Unfinished items (ITM-002 into the next sprint, with its reason) and ## Retrospective; afterwards Progress says team1 has no running sprint and Backlog names team1/02 as its last sprint, ended on 2026-10-30, linked to its record
test("TST-991202: UC-041 1, 2, 4, 6 an ended sprint waits for its review on Progress; its agent's close records review, unfinished items and retrospective in one commit, and the pages show it closed", async () => {
  const w = await closeWorld();
  const before = await pagesOf(w.files);
  assert.match(before.progress, /team1\/02/);
  assert.match(before.progress, /Closed by closer-bot/);
  assert.match(before.progress, /It ended on 2026-10-30; its review and retrospective are not recorded yet\./);
  const was = w.files[RECORD];
  const { result, inputs, failed } = await w.run([CLOSE()]);
  assert.equal(failed, null, JSON.stringify(failed));
  const facts = inputs[0].parts.find((each) => each.name === `facts of sprint ${SPRINT}`);
  assert.deepEqual(JSON.parse(facts.text).increment, [{ item: "ITM-001", pullRequest: "1", realises: ["RULE ONE"], tests: ["TST-001"] }]);
  assert.equal(result.stoppedBecause, "passed");
  assert.equal(w.commits.length, 1);
  assert.deepEqual(w.commits[0].files.map((each) => each.path), [RECORD]);
  assert.match(w.commits[0].message, /^Close sprint team1\/02\n[\s\S]*\nAgent-M-Participant: closer-bot\n/);
  const record = w.files[RECORD];
  assert.ok(record.startsWith(was.trimEnd()), "the record keeps what it had");
  assert.match(record, /## Review\n\nThe increment:\n- ITM-001, merged with 1; realises RULE ONE; guarded by TST-001\.\n\nNot done:\n- ITM-002: /);
  assert.match(record, /Sources of the feedback: issue #7, /);
  assert.match(record, /## Unfinished items\n\nto the backlog:\ninto the next sprint: ITM-002\n\n- ITM-002: into the next sprint — its pull request is still open\n/);
  assert.match(record, /## Retrospective\n\n- went well: The fixtures were quick to build\n- change, to team agreement: Review pull requests the same day\n/);
  const after = await pagesOf(w.files);
  assert.match(after.progress, /no running sprint/);
  assert.doesNotMatch(after.progress, /review and retrospective are not recorded yet/);
  assert.match(after.backlog, /Its last sprint, team1\/02 , ended on 2026-10-30/);
  assert.ok(after.backlogHtml.includes(`href="${LINK}"`), "linked to its record");
});

// TST-991203 · level: system · module: system
// guards: UC-041; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-991202: ITM-002, selected for team1/02, realises RULE ONE, which the SPEC holds; its pull request is open and its job failed
// input: the Product Owner reads ITM-002's row on Progress; the recipe sprint-facts derives the facts the closer is sent
// expect: known positive — Progress draws ITM-002 as blocked, its job failed; the facts name ITM-002 not done with the same state, blocked, and a reason that names the failed job, never "waiting for acceptance"
test("TST-991203: UC-041 2 the items not done reach the closer with the state and reason the pages derive", async () => {
  const w = await closeWorld();
  const pages = await pagesOf(w.files);
  assert.match(pages.progress, /ITM-002 The work of item 2 blocked job \S+ is failed/, "known positive: Progress draws ITM-002 blocked by its failed job");
  const facts = await factsOf(w);
  const state = facts.notDone.find((each) => each.item === "ITM-002");
  assert.equal(state.state, "blocked", JSON.stringify(state));
  assert.match(state.reason ?? "", /fail/);
});

// TST-991204 · level: system · module: system
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: the product of TST-991202; the issue 7 was opened on 2026-10-25, within the sprint, the issue 8 on 2026-09-01, before it; the job of ITM-002 failed; the branch test-results holds a record of pull request 1's head
// input: the close job of team1/02 runs; closer-bot answers with three feedback lines — one for a new item, one for a change to ITM-005, one noted — and the sources it read
// expect: the closer is sent, beside the record and the facts, three parts each naming its source: the issues of the sprint, holding issue #7 with its address and not issue #8; the job records, holding the failed job's record by its path; the result records, holding pull request 1's head; no part holds a mail; the record's review holds the three lines, each with where it goes, and the sources
test("TST-991204: UC-041 3 the closer's feedback comes from the issues, job records and result records, each named, one line per point with where it goes", async () => {
  const w = await closeWorld();
  const close = CLOSE();
  close.review.feedback = [{ line: "No stakeholder took part; the issue 7 asks for a header in the export", goes: "new item", item: null },
    { line: "The failed job of ITM-002 shows ITM-005 needs a narrower store", goes: "change to an item", item: "ITM-005" }, { line: "The tests of ITM-001 passed", goes: "noted", item: null }];
  const { inputs, failed } = await w.run([close]);
  assert.equal(failed, null, JSON.stringify(failed));
  const names = inputs[0].parts.map((each) => each.name);
  assert.deepEqual(names.filter((name) => / of sprint team1\/02$/.test(name)), ["facts of sprint team1/02", "issues of sprint team1/02", "job records of sprint team1/02", "result records of sprint team1/02"]);
  const text = (name) => inputs[0].parts.find((each) => each.name === `${name} of sprint team1/02`).text;
  assert.match(text("issues"), /issue #7 The export misses its header — https:\/\/github\.com\/akmaier\/agent-m\/issues\/7/);
  assert.doesNotMatch(text("issues"), /#8/);
  assert.match(text("job records"), /docs\/jobs\/JOB-20261024-1000-a002\.md — failed; works on ITM-002/);
  assert.match(text("result records"), new RegExp(`runs/${PULLS[0].head}/`));
  assert.ok(!names.some((name) => /mail/i.test(name)), "no part holds a mail");
  const record = w.files[RECORD];
  assert.match(record, /- No stakeholder took part; the issue 7 asks for a header in the export — new item\n/);
  assert.match(record, /- The failed job of ITM-002 shows ITM-005 needs a narrower store — change to an item: ITM-005\n/);
  assert.match(record, /- The tests of ITM-001 passed — noted\n/);
  assert.match(record, /Sources of the feedback: issue #7, the job records of sprint team1\/02 and the result records of sprint team1\/02\./);
});

// TST-991205 · level: system · module: system
// guards: UC-041; A SPRINT ENDS WITH A RETROSPECTIVE; NO COST IS GUESSED
// given: the product of TST-991202: of the jobs that work on team1/02's items, one failed and none reports a cost
// input: the recipe sprint-facts derives the numbers of team1/02 that the closer is sent
// expect: the numbers are derived from the records — one failed job, no retried job, no correction round, no gate reached, no job waiting for a person, no flaky test — and the cost is "unknown", never zero
test("TST-991205: UC-041 5 the numbers of the retrospective are derived from the sprint's records, and an unknown cost is unknown", async () => {
  const { numbers } = await factsOf(await closeWorld());
  assert.deepEqual(numbers, { failedJobs: 1, retriedJobs: 0, correctionRounds: 0, waitingAtGates: "none", waitingForAPerson: "none", flakyTests: [], cost: "unknown" });
});

// TST-991206 · level: system · module: system
// guards: UC-041
// given: the product of TST-991202; closer-bot's feedback holds a line that goes to a new item, the issue 7's header of the export
// input: the close job of team1/02 runs; its closer is sent the kind's prompt and the form of its answer; closer-bot answers with the new item under newItems, as closeSprint takes it
// expect: the closer is asked for the feedback's new items: the form of its answer holds newItems beside retrospective (known positive: it holds retrospective), and the prompt asks for them; the draft with the new item is written in the one commit of the close, the item ITM-011 beside the record (known positive)
test("TST-991206: UC-041 6 the closer is asked for the feedback's new items, which the close commits with the record", async () => {
  const w = await closeWorld();
  const item = { fields: { title: "Write the export's header", level: "module", realises: ["RULE ONE"], modules: ["MOD-store"], builds_on: [], tests: ["unit"], origin: ["the issue 7"] },
    sections: [{ heading: "## Outcome", text: "The export has a header." }, { heading: "## Acceptance", text: "- a unit test." }] };
  const close = { ...CLOSE(), newItems: [item] };
  close.review.feedback.push({ line: "The issue 7: the export misses its header", goes: "new item", item: null });
  const { inputs, failed } = await w.run([close]);
  assert.equal(failed, null, JSON.stringify(failed));
  assert.deepEqual(w.commits[0].files.map((each) => each.path), [RECORD, "docs/backlog/ITM-011-write-the-export-s-header.md"], "known positive: the close commits the new item with the record");
  const form = JSON.stringify(inputs[0].output);
  assert.match(form, /"retrospective"/, "known positive: the form names the retrospective");
  assert.match(form, /"newItems"/, "the form names the new items");
  assert.match(inputs[0].prompt, /new item/i);
  assert.match(inputs[0].prompt, /newItems/);
});

// TST-991207 · level: system · module: system
// guards: UC-041; A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF
// given: the product of TST-991202; the job of kind close-sprint is started for the sprint its parameter sprint names, team1/02
// input: closer-bot answers in the form its answer is given — the review, the unfinished items and the retrospective, and no sprint, which the form does not name
// expect: known positive — the form of the answer names no sprint; the close of team1/02 is recorded: one commit, the record holding ## Review
test("TST-991207: UC-041 1, 6 a close answered in the form the closer is given closes the sprint the job names", async () => {
  const w = await closeWorld();
  const close = CLOSE();
  delete close.sprint;
  const { inputs, failed } = await w.run([close]);
  assert.doesNotMatch(JSON.stringify(inputs[0].output.properties?.draft ?? inputs[0].output), /"sprint"/, "known positive: the form names no sprint");
  assert.equal(failed, null, JSON.stringify(failed));
  assert.equal(w.commits.length, 1);
  assert.match(w.files[RECORD], /\n## Review\n/);
});

// ---------------------------------------------------------------- the alternative flows

// TST-991208 · level: system · module: system
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the product of TST-991202, where ITM-001's pull request is still open too: no item of team1/02 is done
// input: the close job of team1/02 runs; closer-bot answers with both items into the next sprint
// expect: the review is recorded all the same; it says "no item is done: the increment is empty." and lists ITM-001 and ITM-002 as not done
test("TST-991208: UC-041 2a a sprint with no item done is closed with a review that says its increment is empty", async () => {
  const pulls = [pr(1, "ITM-001", "open", "2026-10-20T09:00:00Z", null, { base: "sprint/team1/02" }), PULLS[1], PULLS[2]];
  const w = await closeWorld({ pullRequests: pulls });
  const close = { ...CLOSE(), unfinished: [{ item: "ITM-001", to: "next sprint", reason: "its pull request is open" }, { item: "ITM-002", to: "next sprint", reason: "its pull request is open" }] };
  const { failed } = await w.run([close]);
  assert.equal(failed, null, JSON.stringify(failed));
  assert.match(w.files[RECORD], /## Review\n\nThe increment:\n- no item is done: the increment is empty\.\n\nNot done:\n- ITM-001: [^\n]*\n- ITM-002: /);
});

// TST-991209 · level: system · module: system
// guards: UC-041; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
// given: the product of TST-991202, which is its own instance, whose docs/process.md declares the model and the Definition of Done, and the instance's list of participants; its SPEC holds THE PROCESS MODEL IS DECLARED PER PRODUCT and AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF in its section "## 1. Rules", and docs/spec-freigaben/ holds no queue
// input: closer-bot's retrospective proposes a change to the process model, "Add a review phase", and one to a participant's instructions, "closer-bot reads the mails' issues first"
// expect: the retrospective names where each goes — "change, to process model: Add a review phase" and "change, to a participant's instructions: closer-bot reads the mails' issues first" —; the first commit holds the record alone, the second only files of the queue docs/spec-freigaben/rules/, whose entry proposes the section "## 1. Rules" with the requirements "**ADD A REVIEW PHASE** *()*" / "Add a review phase" and "**CLOSER-BOT READS THE MAILS' ISSUES FIRST** *()*" / "closer-bot reads the mails' issues first" appended; SPEC.md, docs/process.md and docs/participants.md are byte-identical
test("TST-991209: UC-041 5a, 5b a change to the model or to an agent's instructions is recorded with where it goes and proposed as a SPEC change, and changes neither", async () => {
  const w = await closeWorld();
  const process = w.files["docs/process.md"], participants = w.files["docs/participants.md"], spec = w.files["SPEC.md"];
  const close = { ...CLOSE(), retrospective: [{ text: "Add a review phase", kind: "change", goes: "process model" }, { text: "closer-bot reads the mails' issues first", kind: "change", goes: "a participant's instructions" }] };
  const { failed } = await w.run([close]);
  assert.equal(failed, null, JSON.stringify(failed));
  assert.match(w.files[RECORD], /## Retrospective\n\n- change, to process model: Add a review phase\n- change, to a participant's instructions: closer-bot reads the mails' issues first\n/);
  assert.equal(w.commits.length, 2);
  assert.deepEqual(w.commits[0].files.map((each) => each.path), [RECORD]);
  assert.ok(w.commits[1].files.every((each) => each.path.startsWith("docs/spec-freigaben/rules/")), JSON.stringify(w.commits[1].files.map((each) => each.path)));
  const proposal = w.files["docs/spec-freigaben/rules/01-rules.md"] ?? "";
  assert.ok(proposal.startsWith("## 1. Rules\n"), proposal);
  assert.ok(proposal.includes("**ADD A REVIEW PHASE** *()*\nAdd a review phase\n"), proposal);
  assert.ok(proposal.includes("**CLOSER-BOT READS THE MAILS' ISSUES FIRST** *()*\ncloser-bot reads the mails' issues first\n"), proposal);
  assert.equal(w.files["SPEC.md"], spec);
  assert.equal(w.files["docs/process.md"], process);
  assert.equal(w.files["docs/participants.md"], participants);
});

// TST-991210 · level: system · module: system
// guards: UC-041; A SPRINT ENDS WITH A RETROSPECTIVE; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the product of TST-991202
// input: closer-bot first answers with a close whose retrospective is empty, then, asked again, with the clean close
// expect: closer-bot is asked twice; the second request carries the finding under A SPRINT ENDS WITH A RETROSPECTIVE; nothing is committed before the corrected draft; one commit, whose record holds the retrospective, and the job passes in two rounds
test("TST-991210: UC-041 6a a draft without a retrospective goes back to its closer as a correction round, and only the corrected close is committed", async () => {
  const w = await closeWorld();
  const empty = { ...CLOSE(), retrospective: [] };
  let committedBefore = null;
  const { result, inputs, failed } = await w.run([empty, () => { committedBefore = w.commits.length; return CLOSE(); }]);
  assert.equal(failed, null, JSON.stringify(failed));
  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs[1].findings.map((each) => each.rule), ["A SPRINT ENDS WITH A RETROSPECTIVE"]);
  assert.equal(committedBefore, 0, "nothing is committed before the corrected draft");
  assert.equal(w.commits.length, 1);
  assert.match(w.files[RECORD], /## Retrospective\n\n- went well: /);
  assert.deepEqual([result.stoppedBecause, result.rounds.length], ["passed", 2]);
});

// TST-991211 · level: system · module: system
// guards: UC-041; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
// given: the product of TST-991202 after closer-bot's close: team1/02 holds ITM-001, merged into its branch, whose pull request 9 into main is open
// input: the Product Owner gives the increment of team1/02 up with the reason "The branch is stale"
// expect: known positive — before, team1/02 holds ITM-001; one commit appends ## Increment given up with by Product Owner and the reason; afterwards team1/02 holds no item; ITM-001 is still done, the one item of the increment the sprint's facts give
test("TST-991211: UC-041 7b an increment given up holds none of its items, and its done items stay done", async () => {
  const w = await closeWorld();
  await w.run([CLOSE()]);
  const holds = () => { const { sprints, items, architecture } = documentsOf(w.files); return heldItems(sprints, items, architecture, PULLS).filter((each) => each.sprint === SPRINT).map((each) => each.item); };
  assert.deepEqual(holds(), ["ITM-001"], "known positive: the closed sprint holds its done item");
  const context = await w.context();
  await giveUpIncrement(context.product.host, SPRINT, "The branch is stale", { head: context.product.snapshot.commit, trailers: [] });
  assert.equal(w.commits.length, 2);
  assert.match(w.files[RECORD], /\n## Increment given up\n\nat: \d{4}-\d{2}-\d{2}\nby: Product Owner\nreason: The branch is stale\n/);
  assert.deepEqual(holds(), []);
  const facts = JSON.parse((await w.recipe()).find((each) => each.name === `facts of sprint ${SPRINT}`).text);
  assert.deepEqual(facts.increment.map((each) => each.item), ["ITM-001"], "ITM-001 stays done");
});

// TST-991212 · level: system · module: system
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the product of TST-991202, and the same product whose team1/02 holds its review already
// input: the close job runs for team1/02 in each
// expect: known positive — the first close is recorded; the second is refused with AlreadyClosed, nothing is committed, and the record keeps its one review
test("TST-991212: UC-041 a sprint closed once is not closed again", async () => {
  const w = await closeWorld();
  assert.equal((await w.run([CLOSE()])).failed, null, "known positive: the first close is recorded");
  const closed = await closeWorld({ files: await shop({ files: { [RECORD]: `${w.files[RECORD]}` } }) });
  const again = await closed.run([CLOSE()]);
  assert.equal(again.failed?.name, "AlreadyClosed");
  assert.equal(closed.commits.length, 0);
  assert.equal(closed.files[RECORD].match(/\n## Review\n/g).length, 1);
});

